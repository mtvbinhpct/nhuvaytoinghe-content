// Đọc và tách từ điển AnhViet của OVDP (StarDict, FVDP – Hồ Ngọc Đức, GPLv2).
// Đầu ra là chữ thuần: [headword, ipa, [[từ loại, [nghĩa…]]…]]. Bỏ ví dụ (=),
// thành ngữ (từ dòng ! trở đi) và phần chuyên ngành (từ @Chuyên ngành trở đi).
// Spec: docs/superpowers/specs/2026-10-14-tu-dien-anh-viet-design.md §3.3
import fs from 'node:fs';
import zlib from 'node:zlib';

/** @param {string} base đường dẫn không đuôi (…/en_vi) */
export function readStarDict(base) {
  const idx = fs.readFileSync(`${base}.idx`);
  const data = zlib.gunzipSync(fs.readFileSync(`${base}.dict.dz`));
  /** @type {Map<string, string[]>} */
  const out = new Map();
  let i = 0;
  while (i < idx.length) {
    const z = idx.indexOf(0, i);
    const word = idx.subarray(i, z).toString('utf8');
    const off = idx.readUInt32BE(z + 1);
    const size = idx.readUInt32BE(z + 5);
    i = z + 9;
    const body = data.subarray(off, off + size).toString('utf8');
    const list = out.get(word);
    if (list) list.push(body);
    else out.set(word, [body]);
  }
  return out;
}

/** @returns {Map<string, [string, string][]>} */
export function loadPatches(file) {
  /** @type {Map<string, [string, string][]>} */
  const out = new Map();
  const lines = fs.readFileSync(file, 'utf8').split('\n').slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const [hw, bad, good] = line.split('\t');
    const list = out.get(hw) ?? [];
    list.push([bad, good]);
    out.set(hw, list);
  }
  return out;
}

export function applyPatches(headword, body, patches) {
  let used = 0;
  for (const [bad, good] of patches.get(headword) ?? []) {
    const parts = body.split(bad);
    used += parts.length - 1;
    body = parts.join(good);
  }
  return { body, used };
}

// Chữ ASCII trong tên từ loại tiếng Việt (không được nhầm là dạng bất quy tắc).
const STOP = new Set(['danh', 'qui', 'quy']);
const isEnWord = (w) => /^[a-z]+$/.test(w) && !STOP.has(w);

export function parsePosLine(text) {
  const t = text.replace(/\/[^/]*\//g, ' ').replace(/^\s*\([^)]*\)\s*/, '').trimStart();
  const cut = t.search(/[,(]|\s{2,}/);
  const head = (cut < 0 ? t : t.slice(0, cut)).trim().split(/\s+/).filter(Boolean);
  const rest = cut < 0 ? '' : t.slice(cut);
  const irregular = [];
  while (head.length > 1 && isEnWord(head[head.length - 1])) irregular.unshift(head.pop());
  for (const w of rest.split(/[\s,;()&.]+/)) if (isEnWord(w)) irregular.push(w);
  return { pos: head.join(' '), irregular };
}

export function parseEntry(body) {
  let headword = '';
  let ipa = '';
  /** @type {[string, string[]][]} */
  const groups = [];
  const irregular = [];
  let posBuf = null; // dòng từ loại đang gom (dòng /ipa/ có thể vắt sang dòng sau)
  let last = ''; // loại dòng trước: 'sense' | 'other'
  const flushPos = () => {
    if (posBuf === null) return;
    const p = parsePosLine(posBuf);
    groups.push([p.pos, []]);
    irregular.push(...p.irregular);
    posBuf = null;
  };
  for (const raw of body.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('@Chuyên ngành') || line.startsWith('!')) break;
    if (posBuf !== null && /^\s*[/,]/.test(line)) {
      posBuf += ` ${line}`;
      continue;
    }
    if (line.startsWith('@')) {
      flushPos();
      const m = line.match(/^@(.+?)(?:\s+\/(.*)\/)?\s*$/);
      headword = (m ? m[1] : line.slice(1)).trim();
      ipa = m?.[2]?.trim() ?? '';
      last = 'other';
    } else if (line.startsWith('*')) {
      flushPos();
      posBuf = line.slice(1);
      last = 'other';
    } else if (line.startsWith('-')) {
      flushPos();
      if (groups.length === 0) groups.push(['', []]);
      groups[groups.length - 1][1].push(line.slice(1).trim());
      last = 'sense';
    } else if (line.startsWith('=')) {
      flushPos();
      last = 'other';
    } else if (line.trim() && last === 'sense') {
      const senses = groups[groups.length - 1][1];
      senses[senses.length - 1] += ` ${line.trim()}`;
    }
  }
  flushPos();
  const kept = groups.filter(([, s]) => s.length > 0);
  if (kept.length === 0) return null;
  return { headword, ipa, groups: kept, irregular };
}

// Dòng từ loại của OVDP hay kèm lời chú tiếng Anh ("(a pair of tongs)",
// "(dùng với the)"): từ ASCII nào cũng lọt vào danh sách dạng biến cách. Chỉ
// nhận dạng có hình giống headword — cùng chữ đầu, dài lệch không quá 3 —
// còn go/went, be/was, good/better… đã có MANUAL_IRREGULAR ở forms.mjs.
const plausibleForm = (form, head) => form[0] === head[0] && Math.abs(form.length - head.length) <= 3;

export function buildEntries(star, patches) {
  /** @type {Map<string, [string, string, [string, string[]][]]>} */
  const entries = new Map();
  /** @type {Map<string, string[]>} */
  const irregular = new Map();
  const usedPatch = new Set();
  for (const [word, bodies] of star) {
    if (word.includes(' ')) continue;
    const key = word.toLowerCase();
    for (const raw of bodies) {
      const { body, used } = applyPatches(word, raw, patches);
      if (used > 0) usedPatch.add(word);
      const e = parseEntry(body);
      if (!e) continue;
      const cur = entries.get(key);
      if (cur) {
        if (!cur[1]) cur[1] = e.ipa;
        cur[2].push(...e.groups);
      } else {
        entries.set(key, [word, e.ipa, e.groups]);
      }
      // OVDP chép nguyên mục gốc sang tên dạng bất quy tắc (@arisen = mục arise):
      // mục tự liệt kê chính nó là bản chép, không dùng để sinh ánh xạ.
      if (e.irregular.includes(key)) continue;
      for (const f of e.irregular) {
        if (f === key || !plausibleForm(f, key)) continue;
        const list = irregular.get(f) ?? [];
        if (!list.includes(key)) list.push(key);
        irregular.set(f, list);
      }
    }
  }
  const unusedPatches = [...patches.keys()].filter((hw) => !usedPatch.has(hw));
  return { entries, irregular, unusedPatches };
}
