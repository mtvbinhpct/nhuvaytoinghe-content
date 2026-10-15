// Dựng dữ liệu từ điển Anh–Việt cho web (và gián tiếp cho gói mobile).
//   node scripts/dict-en/build-dict-en.mjs
// Đầu vào: data/en-vi/ (OVDP_DIR đổi chỗ StarDict), hai DB nội dung ở gốc repo.
// Đầu ra: web/public/dict-en/<EN_DICT_VERSION>/NNN.json. Spec §3–§6.1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EN_DICT_VERSION, EN_SHARD_COUNT, enKey, enShardName, enShardOf } from '../../web/lib/dict/en-key.mjs';
import { resolveForm } from './forms.mjs';
import { buildEntries, loadPatches, readStarDict } from './ovdp.mjs';
import { collectForms } from './tokens.mjs';

export function loadGlossary(file) {
  /** @type {Map<string, [string, string, string]>} */
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n').slice(1)) {
    if (!line.trim()) continue;
    const [en, vi, pali = '', note = ''] = line.split('\t');
    out.set(enKey(en), [vi, pali, note]);
  }
  return out;
}

export function buildRecords(forms, dict, glossary) {
  const has = (k) => dict.entries.has(k) || glossary.has(k);
  const records = new Map();
  const pending = [...forms];
  const seen = new Set();
  while (pending.length > 0) {
    const form = pending.shift();
    if (seen.has(form)) continue;
    seen.add(form);
    const { heads, parts } = resolveForm(form, has, dict.irregular);
    const gKeys = [form, ...heads].filter((k, i, a) => a.indexOf(k) === i && glossary.has(k));
    const g = [];
    for (const k of gKeys) {
      const v = glossary.get(k);
      if (!g.some((x) => JSON.stringify(x) === JSON.stringify(v))) g.push(v);
    }
    const h = heads.filter((k) => dict.entries.has(k)).map((k) => dict.entries.get(k));
    const rec = {};
    if (g.length) rec.g = g;
    if (h.length) rec.h = h;
    if (!g.length && !h.length && parts) {
      rec.p = parts;
      pending.push(...parts);
    }
    if (Object.keys(rec).length) records.set(form, rec);
  }
  return records;
}

export function writeShards(records, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const shards = Array.from({ length: EN_SHARD_COUNT }, () => []);
  for (const key of [...records.keys()].sort()) shards[enShardOf(key)].push(key);
  let bytes = 0;
  let max = 0;
  shards.forEach((keys, n) => {
    const obj = Object.fromEntries(keys.map((k) => [k, records.get(k)]));
    const text = JSON.stringify(obj);
    fs.writeFileSync(path.join(outDir, enShardName(n)), text);
    bytes += Buffer.byteLength(text);
    max = Math.max(max, Buffer.byteLength(text));
  });
  return { bytes, max };
}

export function coverage(counts, records) {
  let all = 0;
  let hit = 0;
  for (const [k, n] of counts) {
    all += n;
    if (records.has(k)) hit += n;
  }
  return all === 0 ? 0 : hit / all;
}

// "qu", "nh", "đ" đứng một mình không phải âm tiết tiếng Việt: dấu ả/ã/ơ đã rơi.
const SUSPECT = /\p{L} {2}\p{L}|\b(phưng|thưng|nưc|đưc|ngưi|ngưc|trưc|mưi|lưi)\b|\bđ {2}|\bh y\b|(?<!\p{L})(qu|nh|đ) /u;

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const data = path.join(root, 'data/en-vi');
  const ovdp = process.env.OVDP_DIR ?? path.join(data, 'stardict_en_vi');
  const patches = loadPatches(path.join(data, 'patches.tsv'));
  const dict = buildEntries(readStarDict(path.join(ovdp, 'en_vi')), patches);
  const glossary = loadGlossary(path.join(data, 'thuat-ngu.tsv'));
  const { compare, reading } = collectForms([
    path.join(root, 'nhuvaytoinghe-sutta.db'),
    path.join(root, 'nhuvaytoinghe-vinaya.db'),
  ]);
  const forms = new Set([...compare.keys(), ...reading.keys()]);
  const records = buildRecords(forms, dict, glossary);
  const out = path.join(root, 'web/public/dict-en', EN_DICT_VERSION);
  const size = writeShards(records, out);

  const missing = new Map();
  for (const m of [compare, reading]) for (const [k, n] of m) if (!records.has(k)) missing.set(k, (missing.get(k) ?? 0) + n);
  const suspect = [];
  for (const rec of records.values()) for (const [hw, , groups] of rec.h ?? []) {
    if (SUSPECT.test(JSON.stringify(groups)) && !suspect.includes(hw)) suspect.push(hw);
  }
  console.log({
    ovdpEntries: dict.entries.size,
    glossary: glossary.size,
    forms: forms.size,
    records: records.size,
    coverCompare: (coverage(compare, records) * 100).toFixed(2) + '%',
    coverReading: (coverage(reading, records) * 100).toFixed(2) + '%',
    bytes: size.bytes,
    maxShard: size.max,
    unusedPatches: dict.unusedPatches,
  });
  console.log('Thiếu nhiều nhất:', [...missing].sort((a, b) => b[1] - a[1]).slice(0, 50));
  console.log(`Nghi lỗi mã hoá (${suspect.length}):`, suspect.join(', '));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
